import { Component, input, output } from "@angular/core";
import { NbButtonModule, NbIconModule, NbTooltipModule } from "@nebular/theme";

@Component({
  selector: "app-package-toolbar",
  standalone: true,
  imports: [NbButtonModule, NbIconModule, NbTooltipModule],
  templateUrl: "./package-toolbar.component.html",
  styleUrl: "./package-toolbar.component.scss",
})
export class PackageToolbarComponent {
  readonly fileName = input.required<string>();
  readonly busy = input(false);
  readonly canUndo = input(false);
  readonly canRedo = input(false);
  readonly undo = output<void>();
  readonly redo = output<void>();
  readonly chooseFile = output<void>();
  readonly download = output<void>();
}
