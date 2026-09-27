import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import CalculatorPage from './pages/CalculatorPage/CalculatorPage';
import BatchPage from './pages/BatchPage/BatchPage';
import RatesPage from './pages/RatesPage/RatesPage';
import TemplatesPage from './pages/TemplatesPage/TemplatesPage';
import WizardPage from './pages/WizardPage/WizardPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CalculatorPage />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="batch" element={<BatchPage />} />
        <Route path="rates" element={<RatesPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="wizard" element={<WizardPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
