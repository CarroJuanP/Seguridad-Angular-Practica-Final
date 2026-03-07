import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CardModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home {
  // Simple dashboard variables (placeholder values)
  total = 0; // Total count placeholder (update from service when available)
  advance = 0; // Advance indicator placeholder (percentage or similar)

}
