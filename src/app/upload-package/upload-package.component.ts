import { Component, input, output } from "@angular/core";
import { NbButtonModule, NbCardModule, NbIconModule } from "@nebular/theme";

@Component({
  selector: "app-upload-package",
  standalone: true,
  imports: [NbButtonModule, NbCardModule, NbIconModule],
  templateUrl: "./upload-package.component.html",
  styleUrl: "./upload-package.component.scss",
})
export class UploadPackageComponent {
  readonly busy = input(false);
  readonly chooseFile = output<void>();
}
