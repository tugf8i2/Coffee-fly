import { createContext, useContext } from 'react';

export const ConductorThemeContext = createContext(false);
export const useConductorDarkMode = () => useContext(ConductorThemeContext);
