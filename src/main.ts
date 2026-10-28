import { importProvidersFrom } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideAnimations } from "@angular/platform-browser/animations";
import { NbThemeModule } from "@nebular/theme";
import { NbEvaIconsModule } from "@nebular/eva-icons";
import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    importProvidersFrom(
      NbThemeModule.forRoot({ name: "default" }),
      NbEvaIconsModule,
    ),
  ],
}).catch((error: unknown) =>
  console.error("Не удалось запустить приложение", error),
);
