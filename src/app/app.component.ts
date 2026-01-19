import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { NavbarComponent } from "./navbar/navbar.component";
import { AnimatedWaveComponent } from "./animated-wave/animated-wave.component";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
    standalone: true,
      imports: [RouterOutlet, NavbarComponent, AnimatedWaveComponent, CommonModule, RouterLink],
        templateUrl: './app.component.html',
          styleUrl: './app.component.scss'
          })
          export class AppComponent {
            title = 'v1-portofolio';

              // Experience Data (Tetap)
                experiences = [
                    {
                          role: 'Backend Developer',
                                company: 'PT Infinys System Indonesia',
                                      period: '2025 (4 Mos)',
                                            desc: [
                                                    'Developed backend services using JavaScript and Node.js',
                                                            'Migrated monolithic CMS architecture into Headless CMS (Directus)',
                                                                    'Designed and implemented CI/CD pipelines for automated build & deployment',
                                                                            'Built comprehensive End-to-End testing using Playwright',
                                                                                    'Collaborated with frontend and product teams to deliver scalable backend solutions'
                                                                                          ]
                                                                                              }
                                                                                                ];

                                                                                                  // Project Data (Updated: No Desc, Add Image & Link)
                                                                                                    projects = [
                                                                                                        {
                                                                                                              name: 'Sawargi Jaya',
                                                                                                                    sub: 'Boarding House Management System',
                                                                                                                          tech: 'Laravel · GraphQL · n8n',
                                                                                                                                image: 'https://placehold.co/600x400/1a1a1a/FFF?text=Sawargi+Project', // Placeholder
                                                                                                                                      link: 'https://sawargijayadeployrepo-production.up.railway.app' 
                                                                                                                                          },
                                                                                                                                              {
                                                                                                                                                    name: 'Āsvāda',
                                                                                                                                                          sub: 'AI Food Recommendation Platform',
                                                                                                                                                                tech: 'Next.js · Tailwind ',
                                                                                                                                                                      image: 'https://placehold.co/600x400/1a1a1a/FFF?text=Asvada+Project',
                                                                                                                                                                            link: 'https://asvada.vercel.app/'
                                                                                                                                                                                },
                                                                                                                                                                                    {
                                                                                                                                                                                          name: 'Personal Portfolio',
                                                                                                                                                                                                sub: 'This Website',
                                                                                                                                                                                                      tech: 'Angular 17 · Tailwind',
                                                                                                                                                                                                            image: 'https://placehold.co/600x400/1a1a1a/FFF?text=Portfolio+V1',
                                                                                                                                                                                                                  link: '#'
                                                                                                                                                                                                                      }
                                                                                                                                                                                                                        ];
                                                                                                                                                                                                                        }