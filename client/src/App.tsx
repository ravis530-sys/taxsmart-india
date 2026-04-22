import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import WizardPage from './pages/wizard/WizardPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        {/* Calculator wizard gets its own full-screen layout without Navbar */}
        <Route path="/calculator" element={<WizardPage />} />

        {/* All other routes get the Navbar */}
        <Route
          path="*"
          element={
            <>
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
              </Routes>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
