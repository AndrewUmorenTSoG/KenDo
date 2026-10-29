// Encouraging verses (KJV, public domain). `rest` marks the gentler ones shown during breaks.
export interface Verse {
  text: string
  ref: string
  rest?: boolean
}

export const verses: Verse[] = [
  {
    text: 'There is no fear in love; but perfect love casteth out fear: because fear hath torment. He that feareth is not made perfect in love.',
    ref: '1 John 4:18',
    rest: true,
  },
  { text: 'I can do all things through Christ which strengtheneth me.', ref: 'Philippians 4:13' },
  { text: 'Commit thy works unto the LORD, and thy thoughts shall be established.', ref: 'Proverbs 16:3' },
  { text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.', ref: 'Colossians 3:23' },
  { text: 'Let all things be done decently and in order.', ref: '1 Corinthians 14:40' },
  {
    text: 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.',
    ref: 'Galatians 6:9',
  },
  {
    text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.',
    ref: 'Isaiah 40:31',
  },
  {
    text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.',
    ref: 'Joshua 1:9',
  },
  {
    text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.',
    ref: 'Isaiah 41:10',
  },
  {
    text: 'Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ.',
    ref: 'Philippians 1:6',
  },
  {
    text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
    ref: 'Proverbs 3:5–6',
  },
  { text: 'Commit thy way unto the LORD; trust also in him; and he shall bring it to pass.', ref: 'Psalm 37:5' },
  {
    text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.',
    ref: '2 Timothy 1:7',
  },
  { text: 'So teach us to number our days, that we may apply our hearts unto wisdom.', ref: 'Psalm 90:12' },
  { text: 'The joy of the LORD is your strength.', ref: 'Nehemiah 8:10' },
  {
    text: 'My grace is sufficient for thee: for my strength is made perfect in weakness.',
    ref: '2 Corinthians 12:9',
  },
  {
    text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.',
    ref: 'Jeremiah 29:11',
  },
  {
    text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
    ref: 'Romans 8:28',
  },
  {
    text: 'This is the day which the LORD hath made; we will rejoice and be glad in it.',
    ref: 'Psalm 118:24',
  },
  {
    text: 'It is of the LORD’s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.',
    ref: 'Lamentations 3:22–23',
  },
  {
    text: 'The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing.',
    ref: 'Zephaniah 3:17',
  },
  {
    text: 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.',
    ref: 'Psalm 121:1–2',
  },
  {
    text: 'To every thing there is a season, and a time to every purpose under the heaven.',
    ref: 'Ecclesiastes 3:1',
    rest: true,
  },
  { text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', ref: 'Matthew 11:28', rest: true },
  { text: 'Be still, and know that I am God.', ref: 'Psalm 46:10', rest: true },
  {
    text: 'Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.',
    ref: 'Isaiah 26:3',
    rest: true,
  },
  { text: 'Casting all your care upon him; for he careth for you.', ref: '1 Peter 5:7', rest: true },
  { text: 'The LORD is my shepherd; I shall not want.', ref: 'Psalm 23:1', rest: true },
  {
    text: 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.',
    ref: 'John 14:27',
    rest: true,
  },
  {
    text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.',
    ref: 'Philippians 4:6',
    rest: true,
  },
  {
    text: 'Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself.',
    ref: 'Matthew 6:34',
    rest: true,
  },
]

// Same verse all day, a new one tomorrow.
export function verseOfTheDay(date: string) {
  const day = Math.floor(Date.parse(date) / 86_400_000)
  return verses[((day % verses.length) + verses.length) % verses.length]
}

// A random verse for focus (any) or a break (the restful ones), never the one already showing.
export function pickVerse(rest: boolean, current?: Verse) {
  const pool = verses.filter((v) => (rest ? v.rest : true) && v !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}
