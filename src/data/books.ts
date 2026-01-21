export interface Book {
  id: string;
  title: string;
  author: string;
  cover: string;
  description: string;
  condition: 'S' | 'A' | 'B';
  mode: 'rent' | 'sell';
  price?: number;
  owner: {
    nickname: string;
    community: string;
  };
  spineColor: number;
}

export const sampleBooks: Book[] = [
  {
    id: '1',
    title: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop',
    description: 'A poetic tale about a young prince who travels from planet to planet, learning about love, loss, and what truly matters in life.',
    condition: 'S',
    mode: 'rent',
    owner: { nickname: 'BookLover42', community: 'SNU in Paris' },
    spineColor: 1,
  },
  {
    id: '2',
    title: 'Norwegian Wood',
    author: 'Haruki Murakami',
    cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&h=400&fit=crop',
    description: 'A nostalgic story of loss and sexuality set in Tokyo during the late 1960s.',
    condition: 'A',
    mode: 'sell',
    price: 12,
    owner: { nickname: 'TokyoDreamer', community: 'Exchange @ Tokyo U' },
    spineColor: 2,
  },
  {
    id: '3',
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=400&fit=crop',
    description: 'A brief history of humankind exploring the evolution of our species.',
    condition: 'B',
    mode: 'rent',
    owner: { nickname: 'HistoryBuff', community: 'SNU in Paris' },
    spineColor: 3,
  },
  {
    id: '4',
    title: 'Atomic Habits',
    author: 'James Clear',
    cover: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=300&h=400&fit=crop',
    description: 'An easy and proven way to build good habits and break bad ones.',
    condition: 'S',
    mode: 'sell',
    price: 15,
    owner: { nickname: 'ProductivityPro', community: 'Berlin Exchange' },
    spineColor: 4,
  },
  {
    id: '5',
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=300&h=400&fit=crop',
    description: 'A mystical story about following your dreams and listening to your heart.',
    condition: 'A',
    mode: 'rent',
    owner: { nickname: 'Wanderer', community: 'SNU in Paris' },
    spineColor: 5,
  },
  {
    id: '6',
    title: '1984',
    author: 'George Orwell',
    cover: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=300&h=400&fit=crop',
    description: 'A dystopian social science fiction novel about totalitarianism and surveillance.',
    condition: 'B',
    mode: 'rent',
    owner: { nickname: 'ClassicReader', community: 'Exchange @ Tokyo U' },
    spineColor: 6,
  },
  {
    id: '7',
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    cover: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=300&h=400&fit=crop',
    description: 'A groundbreaking tour of the mind explaining the two systems that drive the way we think.',
    condition: 'S',
    mode: 'sell',
    price: 18,
    owner: { nickname: 'MindExplorer', community: 'Berlin Exchange' },
    spineColor: 1,
  },
  {
    id: '8',
    title: 'Kafka on the Shore',
    author: 'Haruki Murakami',
    cover: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=300&h=400&fit=crop',
    description: 'A metaphysical journey following two characters whose paths intertwine.',
    condition: 'A',
    mode: 'rent',
    owner: { nickname: 'SurrealDreamer', community: 'SNU in Paris' },
    spineColor: 2,
  },
];
