import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { ligarModoOffline } from './lib/pwa';

const app = mount(App, { target: document.getElementById('app')! });

if (import.meta.env.PROD) ligarModoOffline();

export default app;
