import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../../components/sidebar/sidebar';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.css'],
  imports: [RouterOutlet, Sidebar]
})
export class MainLayout {}
