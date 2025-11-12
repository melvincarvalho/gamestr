# 🎮 Gamestr - Real-time Gamified Progress Dashboard

<div align="center">

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen.svg)](https://gamestr.vercel.app/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Nostr Protocol](https://img.shields.io/badge/protocol-nostr-purple.svg)](https://nostr.com/)
[![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?logo=javascript&logoColor=%23F7DF1E)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

**Transform your progress tracking into an engaging, gamified experience with real-time updates via the Nostr protocol**

[Live Demo](https://gamestr.vercel.app/) • [Features](#features) • [Getting Started](#getting-started) • [Documentation](#documentation)

</div>

---

## 🚀 Overview

Gamestr is a modern web application that visualizes progress data as an interactive, gamified dashboard. Built on the decentralized Nostr protocol, it provides real-time updates, level progression, achievements, and beautiful visualizations that make tracking progress fun and engaging.

### ✨ Key Features

- **🎯 Real-time Progress Tracking** - Live updates via WebSocket connection to Nostr relays
- **📊 Dynamic Visualizations** - Interactive pie charts showing progress distribution
- **🎮 Gamification System** - Level progression with visual and audio feedback
- **🏆 Achievement Celebrations** - Confetti animations and sound effects for milestones
- **📱 Responsive Design** - Optimized for all devices (desktop, tablet, mobile)
- **🔌 Decentralized Architecture** - Built on Nostr protocol for censorship-resistant data
- **🎨 Beautiful UI** - Modern, clean interface with smooth animations
- **🔊 Audio Feedback** - Optional sound effects for enhanced user experience
- **🔄 Auto-reconnection** - Automatic WebSocket reconnection for reliability
- **⚡ Zero Dependencies** - Lightweight vanilla JavaScript implementation

## 📸 Screenshots

<div align="center">
  <img src="https://via.placeholder.com/800x400/4CAF50/FFFFFF?text=Gamestr+Dashboard" alt="Gamestr Dashboard" width="100%">
  <p><i>Real-time progress dashboard with level progression and achievements</i></p>
</div>

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript with ES6+ modules
- **UI Framework**: Custom lightweight component system
- **Charts**: Chart.js for data visualization
- **Animations**: Canvas Confetti for celebrations
- **Protocol**: Nostr (Notes and Other Stuff Transmitted by Relays)
- **Styling**: Modern CSS3 with responsive design
- **Audio**: HTML5 Audio API for sound effects

## 🚀 Getting Started

### Prerequisites

- Modern web browser with JavaScript enabled
- Access to a Nostr relay (default: `wss://nostr.rocks:4444/`)
- (Optional) Nostr public key for personalized tracking

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/melvincarvalho/gamestr.git
   cd gamestr
   ```

2. **Open in browser**
   ```bash
   # Open index.html directly
   open index.html
   
   # Or use a local server
   python -m http.server 8000
   # Navigate to http://localhost:8000
   ```

3. **Configure (Optional)**
   
   Use URL parameters to customize:
   ```
   https://gamestr.vercel.app/?r=wss://your-relay.com&pubkey=your-nostr-pubkey
   ```

### 🌐 Deployment

Gamestr can be deployed to any static hosting service:

#### Vercel
```bash
npm i -g vercel
vercel
```

#### GitHub Pages
1. Push to GitHub repository
2. Enable GitHub Pages in Settings
3. Select source branch

#### Netlify
1. Connect GitHub repository
2. Deploy with default settings

## 📖 Documentation

### Architecture

```
gamestr/
├── index.html          # Main application entry point
├── js/
│   ├── standalone.module.js  # Component framework
│   └── chart.js        # Chart.js library
├── audio/              # Sound effect files
│   ├── Confirmation.ogg
│   ├── save.ogg
│   └── a_happy_start_bell2.mp3
└── favicon.ico         # Application icon
```

### Configuration

#### URL Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `r` | Nostr relay WebSocket URL | `wss://nostr.rocks:4444/` |
| `pubkey` | Nostr public key to track | Demo key |

#### Level System

The gamification system includes 14 levels with progressively higher thresholds:

```javascript
Level 1:   0 - 4,999 points
Level 2:   5,000 - 10,999 points
Level 3:   11,000 - 18,999 points
...
Level 14:  200,000+ points
```

### Nostr Integration

Gamestr listens for events of kind `33334` from the specified Nostr relay:

```javascript
{
  "kind": 33334,
  "pubkey": "your-public-key",
  "content": "{\"category1\": 1000, \"category2\": 2000}"
}
```

### Customization

#### Adding New Sound Effects

Place audio files in the `audio/` directory and update the HTML:

```html
<audio id="customSound" src="./audio/custom.ogg"></audio>
```

#### Modifying Level Colors

Edit the CSS classes in `index.html`:

```css
.level-1 .progress-fill {
  background: linear-gradient(90deg, #2196f3, #1976d2);
}
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Keep the codebase lightweight and dependency-free
- Ensure mobile responsiveness
- Test WebSocket reconnection logic
- Follow existing code style and patterns
- Update documentation for new features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Nostr Protocol](https://github.com/nostr-protocol/nostr) for decentralized communication
- [Chart.js](https://www.chartjs.org/) for beautiful charts
- [Canvas Confetti](https://github.com/catdad/canvas-confetti) for celebration effects
- The open-source community for inspiration and support

## 🔗 Links

- **Live Demo**: [https://gamestr.vercel.app/](https://gamestr.vercel.app/)
- **Repository**: [https://github.com/melvincarvalho/gamestr](https://github.com/melvincarvalho/gamestr)
- **Issues**: [Report bugs or request features](https://github.com/melvincarvalho/gamestr/issues)
- **Author**: [Melvin Carvalho](https://github.com/melvincarvalho)

---

<div align="center">
  <p>Built with ❤️ for the Nostr community</p>
  <p>⭐ Star us on GitHub if you find this useful!</p>
</div>
