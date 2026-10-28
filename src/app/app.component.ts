import { Component, computed, inject, signal } from "@angular/core";
import { NbAlertModule, NbLayoutModule } from "@nebular/theme";
import { SiqSessionService } from "./siq/siq-session.service";
import { PackageTreeComponent } from "./package-tree/package-tree.component";
import { ShufflePanelComponent } from "./shuffle-panel/shuffle-panel.component";
import { type ShuffleMode, type ShuffleOptions } from "./siq/siq-shuffle";
import { downloadSiqFile } from "./siq/siq-export";
import { AppHeaderComponent } from "./app-header/app-header.component";
import { PackageToolbarComponent } from "./package-toolbar/package-toolbar.component";
import { UploadPackageComponent } from "./upload-package/upload-package.component";
import { LoadingOverlayComponent } from "./loading-overlay/loading-overlay.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    NbAlertModule,
    NbLayoutModule,
    AppHeaderComponent,
    PackageToolbarComponent,
    UploadPackageComponent,
    LoadingOverlayComponent,
    PackageTreeComponent,
    ShufflePanelComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  readonly session = inject(SiqSessionService);
  readonly mode = signal<ShuffleMode>("all");
  readonly selectedRoundIds = signal<readonly string[]>([]);
  readonly selectedThemeIds = signal<readonly string[]>([]);
  readonly notice = signal("");
  readonly downloadError = signal("");
  readonly eligibleRounds = computed(
    () =>
      this.session
        .current()
        ?.structure.rounds.filter((round) => !round.isFinal) ?? [],
  );
  readonly selectedQuestionCount = computed(() => {
    const mode = this.mode();
    const rounds = this.eligibleRounds().filter(
      (round) =>
        mode !== "rounds" || this.selectedRoundIds().includes(round.id),
    );
    return rounds.reduce(
      (total, round) =>
        total +
        round.themes.reduce(
          (sum, theme) =>
            sum +
            (mode === "all" ||
            mode === "rounds" ||
            this.selectedThemeIds().includes(theme.id)
              ? theme.questions.length
              : 0),
          0,
        ),
      0,
    );
  });

  setMode(mode: ShuffleMode): void {
    this.downloadError.set("");
    this.mode.set(mode);
    this.clearSelection();
    this.notice.set("");
  }

  clearSelection(): void {
    this.selectedRoundIds.set([]);
    this.selectedThemeIds.set([]);
  }

  selectAll(): void {
    if (this.mode() === "rounds")
      this.selectedRoundIds.set(this.eligibleRounds().map((round) => round.id));
    if (this.mode() === "themes")
      this.selectedThemeIds.set(
        this.eligibleRounds().flatMap((round) =>
          round.themes.map((theme) => theme.id),
        ),
      );
  }

  toggleRound(selection: { id: string; checked: boolean }): void {
    if (
      this.mode() !== "rounds" ||
      !this.eligibleRounds().some((round) => round.id === selection.id)
    )
      return;
    this.selectedRoundIds.update((ids) =>
      selection.checked
        ? [...new Set([...ids, selection.id])]
        : ids.filter((id) => id !== selection.id),
    );
  }

  toggleTheme(selection: { id: string; checked: boolean }): void {
    if (
      !this.eligibleRounds().some((round) =>
        round.themes.some((theme) => theme.id === selection.id),
      )
    )
      return;
    if (this.mode() === "single-theme") {
      this.selectedThemeIds.set(selection.checked ? [selection.id] : []);
    } else if (this.mode() === "themes") {
      this.selectedThemeIds.update((ids) =>
        selection.checked
          ? [...new Set([...ids, selection.id])]
          : ids.filter((id) => id !== selection.id),
      );
    }
  }

  async shuffle(options: ShuffleOptions): Promise<void> {
    this.downloadError.set("");
    this.notice.set("");
    const result = await this.session.shuffle(options);
    if (!result) return;
    this.clearSelection();
    this.notice.set(
      options.mode === "single-theme"
        ? `Порядок вопросов в теме изменён. Вопросов: ${result.questionCount}`
        : `Перемешано вопросов: ${result.questionCount}. Создано раундов: ${result.createdRoundCount}, тем: ${result.createdThemeCount}`,
    );
  }

  async undo(): Promise<void> {
    this.downloadError.set("");
    if (await this.session.undo()) {
      this.clearSelection();
      this.notice.set("Последнее изменение отменено");
    }
  }

  async redo(): Promise<void> {
    this.downloadError.set("");
    if (await this.session.redo()) {
      this.clearSelection();
      this.notice.set("Изменение восстановлено");
    }
  }

  async selectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.downloadError.set("");
    input.value = "";
    const previous = this.session.current();
    await this.session.open(file);
    if (this.session.current() !== previous) {
      this.setMode("all");
    }
  }

  async download(): Promise<void> {
    this.downloadError.set("");
    this.notice.set("");
    const prepared = await this.session.prepareDownload();
    if (!prepared) return;
    try {
      downloadSiqFile(prepared);
      this.notice.set(
        `Файл «${prepared.fileName}» передан браузеру для скачивания`,
      );
    } catch {
      this.downloadError.set(
        "Не удалось начать скачивание файла. Попробуйте ещё раз",
      );
    }
  }
}
