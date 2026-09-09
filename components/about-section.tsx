"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Hand,
  Images,
  KeyRound,
  Lock,
  Music,
  Pencil,
  Plus,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const guideSteps = [
  {
    number: "01",
    icon: Images,
    title: "Wander through memories",
    body: "Scroll through the gallery wall of photographs. Click any one of them to open it up close — read the little note beneath it and move between moments with the arrows.",
  },
  {
    number: "02",
    icon: BookOpen,
    title: "Open the album",
    body: "Scroll to “Your little album” and press Open the album. The cover opens by itself, like a real book, and the first pages are waiting for you.",
  },
  {
    number: "03",
    icon: Hand,
    title: "Turn the pages",
    body: "Use the arrows at the sides, click the edges of the pages, drag a corner slowly and let go — or simply swipe left and right on a phone. Every page turns like paper.",
  },
  {
    number: "04",
    icon: Music,
    title: "Let it be heard",
    body: "The album is silent until you invite music. Tap Music for the soundtrack from First and Last — a quiet song that plays while you read. It switches off anytime.",
  },
  {
    number: "05",
    icon: Pencil,
    title: "Keep new photographs",
    body: "Once unlocked, “Add a photo” lets her drop in a picture with a title, a date and a few words, then pick a sticker. Photographs added here join the memories wall only.",
  },
  {
    number: "06",
    icon: Plus,
    title: "Add to the album",
    body: "Inside the album, tap Edit album then Add photo to place a photograph straight onto a page — move it, tilt it, write its caption, then Save album. Photographs added here live in the album only and never appear on the memories wall.",
  },
  {
    number: "07",
    icon: KeyRound,
    title: "Your key, your privacy",
    body: "Her photographs are private: visitors see only the few pictures that ship with the site. She unlocks with her passphrase — the Private button in the menu — and can change that key anytime from the Unlocked button.",
  },
  {
    number: "08",
    icon: Lock,
    title: "A keepsake that stays yours",
    body: "Everything is saved privately in this browser with no expiry — return tomorrow, next month, or next year and the book is exactly as she left it. Nothing is ever uploaded anywhere.",
  },
];

export default function AboutSection() {
  return (
    <section
      id="about"
      className="relative overflow-hidden border-t border-white/10 bg-[#1c1512] px-6 py-28 md:px-10 md:py-40 lg:px-16"
    >
      {/* faint celestial dust in the background */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-ivory"
            style={{
              left: `${(i * 37 + 11) % 96}%`,
              top: `${(i * 53 + 7) % 92}%`,
              height: i % 3 === 0 ? "2px" : "1px",
              width: i % 3 === 0 ? "2px" : "1px",
              opacity: 0.2 + (i % 3) * 0.1,
              animation: `album-star-pulse ${6 + (i % 5)}s ease-in-out ${-i * 1.3}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease }}
          className="mb-16 max-w-2xl"
        >
          <p className="mb-5 text-[10px] uppercase tracking-[0.35em] text-blush">
            The little guide
          </p>
          <h2 className="font-sans text-[clamp(2.8rem,5.5vw,5.5rem)] font-light leading-[0.92] tracking-[-0.06em]">
            How it all
            <br />
            <span className="font-serif italic text-sand">works.</span>
          </h2>
          <p className="mt-6 max-w-xl font-serif text-lg italic leading-8 text-sand/70">
            Eight small steps — so every corner of this little website feels
            familiar, and nothing is left unopened.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {guideSteps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.article
                key={step.number}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: (i % 3) * 0.12, duration: 0.9, ease }}
                className="group relative rounded-[4px] border border-white/10 bg-white/[0.025] p-7 transition-colors duration-500 hover:border-blush/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between">
                  <span className="font-serif text-3xl italic text-blush/70 transition-colors duration-500 group-hover:text-blush">
                    {step.number}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-sand/70 transition-colors duration-500 group-hover:border-blush/40 group-hover:text-blush">
                    <Icon size={15} />
                  </span>
                </div>
                <h3 className="mt-6 font-serif text-xl text-ivory">
                  {step.title}
                </h3>
                <p className="mt-3 text-[13px] leading-6 text-sand/65">
                  {step.body}
                </p>
              </motion.article>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 1, ease }}
          className="mt-14 text-center text-[10px] uppercase tracking-[0.28em] text-sand/40"
        >
          Made by Amorth · best experienced slowly, with sound on
        </motion.p>
      </div>
    </section>
  );
}
