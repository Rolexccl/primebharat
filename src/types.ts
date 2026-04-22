export interface Movie {
  id: string;
  title: string;
  image?: string;
  thumbnail: string;
  backdrop: string;
  category: string;
  language: 'Kannada' | 'Telugu' | 'Tamil' | 'Hindi' | 'English';
  year: number;
  description: string;
  videoUrl: string;
  links?: { label: string; url: string }[];
  chapters?: { title: string; time: number }[];
  createdAt?: any;
  updatedAt?: any;
}

export type Category = 'Kannada' | 'Telugu' | 'Tamil' | 'Hindi';

export interface User {
  userId: string;
  password?: string;
  name?: string;
  planName?: string;
  planPrice?: string;
  startDate?: string;
  expiryDate?: string;
  trxId?: string;
  features?: string[];
  createdAt?: any;
  updatedAt?: any;
}
