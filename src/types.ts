export interface Question {
  id: number;
  text: string;
  imageUrl?: string;
  options: string[];
  correct: number;
}

export interface Variant {
  title: string;
  questions: Question[];
}

export interface MathSection {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  variants: Variant[];
}
