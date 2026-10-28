import { Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  NbButtonModule,
  NbCardModule,
  NbCheckboxModule,
  NbIconModule,
  NbInputModule,
  NbSelectModule,
} from "@nebular/theme";
import { type ShuffleMode, type ShuffleOptions } from "../siq/siq-shuffle";

@Component({
  selector: "app-shuffle-panel",
  standalone: true,
  imports: [
    FormsModule,
    NbButtonModule,
    NbCardModule,
    NbCheckboxModule,
    NbIconModule,
    NbInputModule,
    NbSelectModule,
  ],
  templateUrl: "./shuffle-panel.component.html",
  styleUrl: "./shuffle-panel.component.scss",
})
export class ShufflePanelComponent {
  readonly mode = input<ShuffleMode>("all");
  readonly roundIds = input<readonly string[]>([]);
  readonly themeIds = input<readonly string[]>([]);
  readonly questionCount = input(0);
  readonly busy = input(false);
  readonly modeChange = output<ShuffleMode>();
  readonly shuffleRequested = output<ShuffleOptions>();
  readonly selectAll = output<void>();
  readonly clearSelection = output<void>();

  readonly settings = {
    roundCount: 3 as number | null,
    themesPerRound: 6 as number | null,
    questionsPerTheme: 5 as number | null,
    themeName: "Сборная тема",
    numberThemes: true,
  };

  invalidNumber(value: number | null): boolean {
    return value === null || !Number.isSafeInteger(value) || value < 1;
  }

  validationMessage(): string {
    if (this.mode() !== "single-theme") {
      if (this.invalidNumber(this.settings.questionsPerTheme))
        return "Количество вопросов в теме должно быть целым положительным числом";
      if (!this.settings.themeName.trim()) return "Введите название новых тем";
      if (this.mode() !== "themes") {
        if (this.invalidNumber(this.settings.roundCount))
          return "Количество раундов должно быть целым положительным числом";
        if (this.invalidNumber(this.settings.themesPerRound))
          return "Количество тем в раунде должно быть целым положительным числом";
      }
    }
    if (this.mode() === "rounds" && !this.roundIds().length)
      return "Выберите раунды в структуре пакета";
    if (
      (this.mode() === "themes" || this.mode() === "single-theme") &&
      !this.themeIds().length
    ) {
      return this.mode() === "single-theme"
        ? "Выберите одну тему в структуре пакета"
        : "Выберите темы в структуре пакета";
    }
    return this.questionCount()
      ? ""
      : "В выбранной области нет вопросов для перемешивания";
  }

  plannedThemes(): number {
    return Math.ceil(
      this.questionCount() / (this.settings.questionsPerTheme ?? 1),
    );
  }

  plannedRounds(): number {
    return this.mode() === "themes"
      ? 1
      : Math.ceil(this.plannedThemes() / (this.settings.themesPerRound ?? 1));
  }

  submit(): void {
    if (this.busy() || this.validationMessage()) return;
    const mode = this.mode();
    if (mode === "single-theme") {
      this.shuffleRequested.emit({ mode, themeId: this.themeIds()[0] });
      return;
    }
    const themeSettings = {
      questionsPerTheme: this.settings.questionsPerTheme!,
      themeName: this.settings.themeName.trim(),
      numberThemes: this.settings.numberThemes,
    };
    if (mode === "themes") {
      this.shuffleRequested.emit({
        mode,
        ...themeSettings,
        themeIds: [...this.themeIds()],
      });
      return;
    }
    const roundSettings = {
      ...themeSettings,
      roundCount: this.settings.roundCount!,
      themesPerRound: this.settings.themesPerRound!,
    };
    this.shuffleRequested.emit(
      mode === "rounds"
        ? { mode, ...roundSettings, roundIds: [...this.roundIds()] }
        : { mode, ...roundSettings },
    );
  }
}
