import { AnimatePresence, Transition, Variants, motion } from 'motion/react';
import styles from './Loading.m.scss';
import loadingLogo from '../../../icons/input.svg';

const containerAnimateVariants: Variants = {
  initial: { opacity: 0 },
  open: { opacity: 1 },
};
const containerAnimateTransition: Transition<number> = {
  duration: 0.5,
  delay: 1,
};

const messageAnimateVariants: Variants = {
  initial: { y: -16, opacity: 0 },
  open: { y: 0, opacity: 1 },
  leave: { y: 16, opacity: 0 },
};
const messageAnimateTransition: Transition<number> = {
  duration: 0.2,
  ease: 'easeOut',
};

export function Loading({ message }: { message?: string }) {
  return (
    <section className={styles.loading}>
      <motion.div 
        className={styles.logoContainer}
        initial={{ scale: 0.8, opacity: 0.5 }}
        animate={{ 
          scale: [0.8, 1.1, 1],
          opacity: [0.5, 1, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{
          duration: 2,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 0.3
        }}
      >
        <img src={loadingLogo} alt="Loading" className={styles.logo} />
      </motion.div>

      <motion.div
        className={styles.textContainer}
        initial="initial"
        animate="open"
        variants={containerAnimateVariants}
        transition={containerAnimateTransition}
      >
        <AnimatePresence>
          {message && (
            <motion.div
              key={message}
              className={styles.text}
              initial="initial"
              animate="open"
              exit="leave"
              variants={messageAnimateVariants}
              transition={messageAnimateTransition}
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
