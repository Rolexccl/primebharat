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
  createdAt?: any;
  updatedAt?: any;
}

export type Category = 'Kannada' | 'Telugu' | 'Tamil' | 'Hindi';
