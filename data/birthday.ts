export type Memory = {
  id: string;
  src: string;
  alt: string;
  title: string;
  date: string;
  caption: string;
  layout: "tall" | "wide" | "square" | "feature";
  stickerIndex?: number;
  customStickerSrc?: string;
};

export const birthday = {
  celebrantName: "Lunatey",
  senderName: "Jaypeeru",
  year: "MADE BY AMORTH",
  /* The celebrant's private key. She enters it once on her own device to
     unlock her uploaded photos and the album editing tools. Visitors never
     see them. She can also change this key anytime from the "Unlocked"
     button — the change is remembered on her device. */
  celebrantPassphrase: "lunatey",
  celebrantHint: "The name of this little website.",
  heroImage: "/img/thea9.jpg",
  letterIntro: "Some things are easier to write than say.",
  message: [
    "Happy Birthday, Teyy!!.",
    "Haluu tey! kamusta kana? I don\u2019t know if sa website na to is matuwa ka or what but I hope ma enjoy mo ito, this is your own website so feel free to use it",
    "Anw, first of all I want to say that I'm not good as you like ung sa mga drawing like you did to me nong sa birthday ko and I now nag effort ikaw don and pinaghirapan mo tlga yon",
    "So i made a decision and I feel this is the right time para mapakita naman sayo ung something na ginawa mo para sakin like ung sa drawing, ayun nga lang website to",
    "So I hope you like it and I hope you trully enjoy it, I give all my effortch to this kaya ginadahan ko tlga para mapakita manlang sayo na, yeah hahahaha",
    "Sorry rin pala ah if hindi kita pinapansin or what huhu, nahihiya lang tlga ako sa tru lng, baka kasi uncomfy ikaw na malapit ako or nakakausap mo me ",
    "so ayun I decided na lumayo nalang muna, also another reason is you already unfollowsu me sa mga socials mu, that's why I decided na ilayo ko nalang tlga ung sarili ko sau",
    "and also hindi narin para alamin pa ung reason why mo me inunfollow, get's ko naman hehe, it's for your peace of mind naman na so hindi kona rin inalam mula noon, it's up to you and not me, so I don't have the right to ask you na why ganon hahah",
    "Anw, I hope naging mabuti na sayo ung mundo, nagiging ayos kana ulit and bumalik na ung totoong ngiti sa mga labi mu nang hindi peke or what, cute ka pagnakangiti so piliin mo palagi na ngumiti, piliin mo palagi kung san ka mas sasaya despite all the problems, stress and anu pa na nararamdaman mu",
    "Be proud of yourself always for going through all the hardships and still being strong, I know it's not easy but you did it and that's why I know na soafer brave mu and keep always strong and trust God that all will be alright in time:>",
    "Also this may looks weird to you but I'm always here for you, even if you need me or not, even though hindi tayo nag uusap or pansinan, I'm still here parin naman as your friend, actually hindi naman tlga ako lumayo haahaha",
    "ginusto ko nalng na tignan ka mula sa malayo, because na realize ko sa sarili ko na masaya and payapa pla tignan and maging proud, also maging supporter ng isang tao mula sa malayo ng tahimik and no one else there know that",
    "sobrang peaceful lang tlga kaya naman mas pinili ko ang tingnan nalng you sa malayo, and hoping na someday, in God's perfect and right time, I hope God give us time to talk to each other again",
    "hindi para pag usapan ung past, kundi pag usapan ung present, ano na nga ba nangyari sa life nating dalwa, I hope someday makapag catch up us sa isa't isa ng wala ng ilangan pa.",
    "Ayun lang namn, pakamusta nalng din pla kay tita hihi, I hope okay namn sya and I hope okay kayo ng family mu, also sa family ng mother side mu, take care always! And I hope this year gives you countless reasons to smile, laugh, and be proud of yourself. You deserve beautiful things, in every season. ",
    "May God always protecting you and your family, and may He bless you with good health, happiness, and success in life. Goodluck sa acads mu, thesis, demo and sa lahat ng mga ginagawa mu, padayon lng palagi, onti nlng Future Teacher, you almost there na sa mga dream mu. Anw, sooo yeappp haha see ya out there? this is not a goodbye but see ya lateruu, baibaichhh!!",
    "Happy Birthday again teyyy!! I\u2019m so really glad if nabasa mo this and ginagamit mo ung website hihi.",
  ],
  memories: [
    // The celebrant adds photographs through the website itself — as "Add a
    // photo" (her memories wall) or "Add to the album" (inside the book).
    // Keep this list empty; uploaded photos are stored per-device, privately.
    
  ] as Memory[],
};
