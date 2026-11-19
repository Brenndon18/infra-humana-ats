function applyTheme(theme){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='dark'?'dark':'light';document.querySelectorAll('.theme-toggle').forEach(b=>b.textContent=theme==='dark'?'☀ Modo normal':'◐ Modo noturno')}
function toggleTheme(){let theme=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme(theme);try{localStorage.setItem('ih-theme',theme)}catch{}}
try{applyTheme(localStorage.getItem('ih-theme')==='dark'?'dark':'light')}catch{applyTheme('light')}
