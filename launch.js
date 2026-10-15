/* Local supplied film; no network, storage, native bridge or engine changes. */
'use strict';
(() => {
 if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 const overlay=document.createElement('div'); overlay.className='quant-opening';
 overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-label','Quant opening film');
 const video=document.createElement('video');video.muted=true;video.playsInline=true;
 video.src='video/'+(Math.random()<.5?'quant-film-a.mp4':'quant-film-b.mp4');
 const skip=document.createElement('button');skip.textContent='Enter Quant';
 const previous=document.activeElement;
 let timer;const close=()=>{clearTimeout(timer);video.pause();video.removeAttribute('src');video.load();overlay.remove();if(previous&&previous.focus)previous.focus();};
 skip.addEventListener('click',close);video.addEventListener('ended',close,{once:true});video.addEventListener('error',close,{once:true});
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){e.preventDefault();skip.focus();}});
 overlay.append(video,skip);document.body.append(overlay);skip.focus();
 timer=setTimeout(close,45000);video.play().catch(close);
})();
