import { Injectable, computed, signal } from "@angular/core";
import { loadSiq, parseContentXml, type LoadedSiq } from "./siq-package";
import {
  shuffleContentXml,
  type ShuffleOptions,
  type ShuffleResult,
} from "./siq-shuffle";
import { prepareSiqDownload, type SiqDownload } from "./siq-export";

@Injectable({ providedIn: "root" })
export class SiqSessionService {
  private readonly currentPackage = signal<LoadedSiq | null>(null);
  private readonly pending = signal(false);
  private readonly activity = signal("");
  private readonly completion = signal<number | null>(null);
  private readonly failure = signal("");
  private readonly history = signal<readonly string[]>([]);
  private readonly historyIndex = signal(-1);
  readonly current = this.currentPackage.asReadonly();
  readonly loading = this.pending.asReadonly();
  readonly operation = this.activity.asReadonly();
  readonly progress = this.completion.asReadonly();
  readonly error = this.failure.asReadonly();
  readonly canUndo = computed(() => !this.pending() && this.historyIndex() > 0);
  readonly canRedo = computed(
    () => !this.pending() && this.historyIndex() < this.history().length - 1,
  );

  async prepareDownload(): Promise<SiqDownload | null> {
    if (this.pending()) return null;
    const current = this.currentPackage();
    if (!current) {
      this.failure.set("Сначала загрузите SIQ-файл");
      return null;
    }
    return this.run<SiqDownload | null>(
      "Готовим SIQ-файл",
      () =>
        prepareSiqDownload(current, (percent) => this.completion.set(percent)),
      null,
      "Не удалось подготовить SIQ-файл",
    );
  }

  async undo(): Promise<boolean> {
    if (!this.canUndo()) return false;
    return this.run(
      "Отменяем изменение",
      () => this.restore(this.historyIndex() - 1),
      false,
      "Не удалось отменить изменение",
    );
  }

  async redo(): Promise<boolean> {
    if (!this.canRedo()) return false;
    return this.run(
      "Восстанавливаем изменение",
      () => this.restore(this.historyIndex() + 1),
      false,
      "Не удалось восстановить изменение",
    );
  }

  private restore(index: number): boolean {
    const current = this.currentPackage();
    const contentXml = this.history()[index];
    if (!current || contentXml === undefined) return false;
    try {
      const parsed = parseContentXml(contentXml);
      this.currentPackage.set({ ...current, contentXml, ...parsed });
      this.historyIndex.set(index);
      this.failure.set("");
      return true;
    } catch {
      this.failure.set("Не удалось восстановить состояние пакета");
      return false;
    }
  }

  async shuffle(options: ShuffleOptions): Promise<ShuffleResult | null> {
    if (this.pending()) return null;
    const current = this.currentPackage();
    this.failure.set("");
    if (!current) {
      this.failure.set("Сначала загрузите SIQ-файл");
      return null;
    }
    return this.run<ShuffleResult | null>(
      "Перемешиваем вопросы",
      () => {
        const result = shuffleContentXml(current.contentXml, options);
        if (result.contentXml !== current.contentXml) {
          this.history.update((states) => [
            ...states.slice(0, this.historyIndex() + 1),
            result.contentXml,
          ]);
          this.historyIndex.update((index) => index + 1);
        }
        this.currentPackage.set({
          ...current,
          contentXml: result.contentXml,
          document: result.document,
          structure: result.structure,
        });
        return result;
      },
      null,
      "Не удалось перемешать вопросы",
    );
  }

  async open(file: File): Promise<void> {
    await this.run(
      "Читаем пакет",
      async () => {
        const loaded = await loadSiq(file);
        this.currentPackage.set(loaded);
        this.history.set([loaded.contentXml]);
        this.historyIndex.set(0);
      },
      undefined,
      "Не удалось открыть SIQ-файл",
    );
  }

  private async run<T>(
    label: string,
    work: () => T | Promise<T>,
    fallback: T,
    failureMessage: string,
  ): Promise<T> {
    if (this.pending()) return fallback;
    this.pending.set(true);
    this.activity.set(label);
    this.completion.set(null);
    this.failure.set("");
    try {
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame !== "function") {
          setTimeout(resolve, 0);
          return;
        }
        const timeout = setTimeout(resolve, 100);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            clearTimeout(timeout);
            resolve();
          }),
        );
      });
      return await work();
    } catch (error: unknown) {
      this.failure.set(error instanceof Error ? error.message : failureMessage);
      return fallback;
    } finally {
      this.pending.set(false);
      this.activity.set("");
      this.completion.set(null);
    }
  }
}
