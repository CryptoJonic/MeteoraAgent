import './styles.css';

import { GalkaLabApp } from './app/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Galka Lab root element was not found.');

const application = new GalkaLabApp(root);
void application.start();
