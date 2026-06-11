import React from 'react';

interface Props {
  donationUrl: string;
}

// Always-visible "Buy me a coffee" button.
const CoffeeFab: React.FC<Props> = ({ donationUrl }) => (
  <a
    className="coffee-fab"
    href={donationUrl || 'https://buy.stripe.com/test_5kQ4gzaPN9m83qH2kj9IQ00'}
    target="_blank"
    rel="noreferrer"
    title="Buy me a coffee if your trading is in profit — best wishes 🙏"
  >
    <span className="coffee-fab-icon">☕</span>
    <span className="coffee-fab-text">
      <span className="coffee-fab-title">Buy me a coffee</span>
      <span className="coffee-fab-sub">If you're in profit — best wishes 🙏</span>
    </span>
  </a>
);

export default CoffeeFab;
