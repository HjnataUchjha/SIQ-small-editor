import { Component, input, output } from "@angular/core";
import {
  NbAccordionModule,
  NbCardModule,
  NbCheckboxModule,
  NbIconModule,
  NbRadioModule,
  NbTooltipModule,
} from "@nebular/theme";
import { SiqStructure } from "../siq/siq-package";
import { type ShuffleMode } from "../siq/siq-shuffle";

@Component({
  selector: "app-package-tree",
  standalone: true,
  imports: [
    NbAccordionModule,
    NbCardModule,
    NbCheckboxModule,
    NbIconModule,
    NbRadioModule,
    NbTooltipModule,
  ],
  templateUrl: "./package-tree.component.html",
  styleUrl: "./package-tree.component.scss",
})
export class PackageTreeComponent {
  readonly structure = input.required<SiqStructure>();
  readonly mode = input<ShuffleMode>("all");
  readonly selectedRoundIds = input<readonly string[]>([]);
  readonly selectedThemeIds = input<readonly string[]>([]);
  readonly disabled = input(false);
  readonly roundSelection = output<{ id: string; checked: boolean }>();
  readonly themeSelection = output<{ id: string; checked: boolean }>();
}
