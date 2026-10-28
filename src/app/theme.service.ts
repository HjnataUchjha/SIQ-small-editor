import { Injectable, inject, signal } from "@angular/core";
import { NbThemeService } from "@nebular/theme";

const THEMES = [
  { name: "default", label: "Светлая" },
  { name: "dark", label: "Тёмная" },
  { name: "cosmic", label: "Космическая" },
  { name: "corporate", label: "Корпоративная" },
] as const;

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly nebular = inject(NbThemeService);
  private readonly storageKey = "siq-small-editor.theme";
  readonly current = signal<(typeof THEMES)[number]>(THEMES[0]);

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(this.storageKey);
    } catch {
      // При запрете localStorage переключение работает в пределах текущего окна.
    }
    this.apply(THEMES.find((theme) => theme.name === saved) ?? THEMES[0]);
  }

  next(): void {
    const index = THEMES.findIndex(
      (theme) => theme.name === this.current().name,
    );
    const theme = THEMES[(index + 1) % THEMES.length];
    this.apply(theme);
    try {
      localStorage.setItem(this.storageKey, theme.name);
    } catch {
      // Отсутствие доступа к хранилищу не мешает работать с приложением.
    }
  }

  private apply(theme: (typeof THEMES)[number]): void {
    this.current.set(theme);
    document.documentElement.dataset["theme"] = theme.name;
    this.nebular.changeTheme(theme.name);
  }
}
