import { Component, input } from "@angular/core";
import { NbCardModule, NbSpinnerModule } from "@nebular/theme";

@Component({
  selector: "app-loading-overlay",
  standalone: true,
  imports: [NbCardModule, NbSpinnerModule],
  templateUrl: "./loading-overlay.component.html",
  styleUrl: "./loading-overlay.component.scss",
})
export class LoadingOverlayComponent {
  readonly message = input.required<string>();
  readonly progress = input<number | null>(null);
}
