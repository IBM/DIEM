import {
    AppErrorComponent,
    ForbiddenComponent,
    NotFoundComponent,
    UnauthorizedComponent,
} from '@mydiem/diem-angular-util/lib/pages';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AppRoutingGuard } from './app.routing.guard';
import { HelpComponent } from './app/help/help.component';
import { TermsComponent } from './app/terms/terms.component';

const appConfig: Routes = [
    { component: AppErrorComponent, path: '500', data: { title: 'Application Error' } },
    { component: ForbiddenComponent, path: '403', data: { title: 'Forbidden' } },
    { component: HelpComponent, path: 'help', data: { title: 'Help' } },
    { component: NotFoundComponent, path: '404', data: { title: 'Not Found' } },
    { component: TermsComponent, path: 'terms', data: { title: 'Terms' } },
    { component: UnauthorizedComponent, path: '401', data: { title: 'Not Authorized' } },
    {
        canLoad: [AppRoutingGuard],
        loadChildren: async () => import('./app/main/main.module').then((m) => m.MainModule),
        path: '',
    },
];

@NgModule({
    exports: [RouterModule],
    imports: [RouterModule.forRoot(appConfig, { preloadingStrategy: PreloadAllModules })],
})
export class AppRouting {}
