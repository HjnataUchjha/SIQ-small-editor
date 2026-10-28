import { Component, computed, inject } from "@angular/core";
import { NbButtonModule, NbIconModule, NbTooltipModule } from "@nebular/theme";
import { ThemeService } from "../theme.service";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [NbButtonModule, NbIconModule, NbTooltipModule],
  templateUrl: "./app-header.component.html",
  styleUrl: "./app-header.component.scss",
})
export class AppHeaderComponent {
  readonly themes = inject(ThemeService);
  readonly themeStatus = computed(
    () =>
      (
        ({
          default: "primary",
          dark: "warning",
          cosmic: "success",
          corporate: "info",
        }) as const
      )[this.themes.current().name],
  );
}
