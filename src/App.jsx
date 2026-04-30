import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Modal from './components/Modal';
import BackgroundDrops from './components/BackgroundDrops';
import { useModal } from './hooks/useModal';

export default function App() {
  const { activeModal, openModal, closeModal } = useModal();

  return (
    <>
      <BackgroundDrops />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar onOpenModal={openModal} />
        <Hero onOpenModal={openModal} />
      </div>

      <Modal activeModal={activeModal} onClose={closeModal} />
    </>
  );
}
