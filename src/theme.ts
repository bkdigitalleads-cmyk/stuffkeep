import { useColorScheme } from 'react-native';

export interface Theme {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textSecondary: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  danger: string;
  border: string;
  success: string;
  isDark: boolean;
}

// Calm teal: trustworthy, insurance-adjacent, distinct from every
// competitor in the niche (they're all blue or orange).
export const lightTheme: Theme = {
  bg: '#F5F8F7',
  card: '#FFFFFF',
  cardAlt: '#EAF1EF',
  text: '#152220',
  textSecondary: '#5A6B67',
  textFaint: '#93A5A0',
  accent: '#0F766E',
  accentSoft: '#D8EFEA',
  danger: '#C53030',
  border: '#DFE8E5',
  success: '#2F7D4F',
  isDark: false,
};

export const darkTheme: Theme = {
  bg: '#121716',
  card: '#1B2321',
  cardAlt: '#232D2A',
  text: '#EDF3F1',
  textSecondary: '#A4B4AF',
  textFaint: '#6E7E79',
  accent: '#2DBFAE',
  accentSoft: '#1E3733',
  danger: '#F56565',
  border: '#2C3835',
  success: '#68B587',
  isDark: true,
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export const fonts = {
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
