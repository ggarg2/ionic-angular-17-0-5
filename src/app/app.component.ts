import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {IonApp, IonBackButton, IonButtons, IonContent, IonHeader} from "@ionic/angular/standalone";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, IonApp, IonHeader, IonButtons, IonBackButton, IonContent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'ng-17';
}
