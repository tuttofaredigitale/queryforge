// src/composables/useMeta.js
import { onMounted, onUnmounted } from 'vue';

export function useMeta(metaData) {
  const setMeta = (data) => {
    // Pulisci i vecchi meta tag "og:" per evitare duplicati
    document.querySelectorAll('meta[property^="og:"]').forEach(tag => tag.remove());

    document.title = data.title || 'QueryForge';
    
    // Description
    const descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag) {
      descriptionTag.setAttribute('content', data.description || '');
    }

    // Open Graph (per social media)
    if (data.title) {
      const ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      ogTitle.setAttribute('content', data.title);
      document.head.appendChild(ogTitle);
    }
    if (data.description) {
      const ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      ogDescription.setAttribute('content', data.description);
      document.head.appendChild(ogDescription);
    }
    if (data.image) {
      const ogImage = document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      ogImage.setAttribute('content', data.image);
      document.head.appendChild(ogImage);
    }
    const ogType = document.createElement('meta');
    ogType.setAttribute('property', 'og:type');
    ogType.setAttribute('content', 'website'); // o 'article' per il blog
    document.head.appendChild(ogType);
  };

  onMounted(() => {
    setMeta(metaData);
  });
  
  // Opzionale: pulizia quando il componente viene smontato
  onUnmounted(() => {
    // Potresti voler ripristinare i tag di default qui
  });
}