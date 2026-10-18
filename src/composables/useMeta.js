// src/composables/useMeta.js
import { onMounted, onUnmounted } from 'vue';

// Aggiorna un meta tag se esiste già (quelli fissi sono in index.html), altrimenti lo crea
function setTag(attribute, key, content) {
  if (!content) return;
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function useMeta(metaData) {
  const setMeta = (data) => {
    document.title = data.title || 'QueryForge';

    setTag('name', 'description', data.description);

    // Open Graph (per social media)
    setTag('property', 'og:title', data.title);
    setTag('property', 'og:description', data.description);
    setTag('property', 'og:image', data.image);
  };

  onMounted(() => {
    setMeta(metaData);
  });
  
  // Opzionale: pulizia quando il componente viene smontato
  onUnmounted(() => {
    // Potresti voler ripristinare i tag di default qui
  });
}