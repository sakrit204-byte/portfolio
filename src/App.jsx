import { useCallback, useState } from 'react';
import Grain from './components/Grain';
import Cursor from './components/Cursor';
import Nav from './components/Nav';
import Hero from './components/Hero';
import CaseStudy from './components/CaseStudy';
import { About, Contact, Footer, Services, Stack, Stats, Work } from './components/Sections';

export default function App() {
  const [openNode, setOpenNode] = useState(null);

  const open = useCallback((node) => setOpenNode(node), []);
  const close = useCallback(() => setOpenNode(null), []);

  return (
    <>
      <a className="srOnly skipLink" href="#work">
        Skip the map, go to the work
      </a>

      <Grain />
      <Cursor />
      <Nav />

      <main>
        <Hero onOpen={open} />
        <Stats />
        <Work onOpen={open} />
        <Services />
        <Stack />
        <About />
        <Contact />
      </main>

      <Footer />

      <CaseStudy node={openNode} onClose={close} />
    </>
  );
}
