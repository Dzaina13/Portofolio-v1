import { Component } from '@angular/core';
import { AnimatedWaveComponent } from './animated-wave/animated-wave.component';
import { NavbarComponent } from './navbar/navbar.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AnimatedWaveComponent, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {}
