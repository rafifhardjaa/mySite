export const SITE = {
  name: 'Abdurrahman Ar Rafif',
  nickname: 'Rafif',
  // Document title. The full name would crowd a browser tab, but the page
  // itself still leads with SITE.name.
  identity: {
    en: 'Ar Rafif, Fullstack Web Developer',
    id: 'Ar Rafif, Fullstack Web Developer',
  },
  role: {
    en: 'Web Developer & Automation Engineer',
    id: 'Web Developer & Engineer Otomasi',
  },
  bio: {
    en: "I build web applications end to end and wrote the automation tooling behind a WebGL game startup's ad campaigns. IT undergrad at Universitas PGRI Semarang.",
    id: 'Saya membangun aplikasi web dari awal sampai akhir dan menulis perangkat lunak otomasi untuk kampanye iklan startup game WebGL. Mahasiswa Teknik Informatika di Universitas PGRI Semarang.',
  },
  description: {
    en: 'Full-stack developer building client web apps and automation tooling.',
    id: 'Full-stack developer membangun aplikasi web klien dan perangkat lunak otomasi.',
  },
  availability: {
    en: 'Available now for work, internships, or collaboration',
    id: 'Tersedia sekarang untuk bekerja, magang, atau kolaborasi',
  },
  url: 'https://rafifhardja.xyz',
  github: 'https://github.com/rafifhardjaa',
  linkedin: 'https://linkedin.com/in/yourusername',
  email: 'abdurrahmanarrafif651@email.com',
} as const

export const NAV_LINKS = [
  { href: '/', key: 'nav.home' },
  { href: '/notes', key: 'nav.notes' },
  { href: '/now', key: 'nav.now' },
  { href: '/uses', key: 'nav.uses' },
  { href: '/contact', key: 'contact.navLabel' },
] as const

// Shared by the inline text links on /now and /uses. They looked identical in
// both files and had started to drift.
export const INLINE_LINK_CLASS =
  'inline-flex items-center gap-1 underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent'
