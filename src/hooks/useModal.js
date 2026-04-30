import { useState, useEffect, useCallback } from 'react';

export function useModal() {
  const [activeModal, setActiveModal] = useState(null); // null | 'skills' | 'projects' | 'experiences'

  const openModal = useCallback((kind) => setActiveModal(kind), []);
  const closeModal = useCallback(() => setActiveModal(null), []);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = activeModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [activeModal]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeModal]);

  return { activeModal, openModal, closeModal };
}
