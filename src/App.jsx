import Nav from './components/Nav';
import Hero from './components/Hero';
import { About, Contact, Experience, Footer, MoreWork, Skills, Work } from './components/Sections';

export default function App() {
  return (
    <>
      <a className="srOnly skipLink" href="#work">
        Skip to the work
      </a>
      <Nav />
      <main>
        <Hero />
        <Work />
        <MoreWork />
        <Experience />
        <Skills />
        <About />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
