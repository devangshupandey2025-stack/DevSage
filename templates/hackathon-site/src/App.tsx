import Hero from './components/Hero';
import Dates from './components/Dates';
import Prizes from './components/Prizes';
import Teams from './components/Teams';
import About from './components/About';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0b1120] text-white">
      <Hero />
      <Dates />
      <Prizes />
      <Teams />
      <About />
      <Footer />
    </div>
  );
}
