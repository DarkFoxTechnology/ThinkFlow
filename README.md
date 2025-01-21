<!--
 * ......................................&&.........................
 * ....................................&&&..........................
 * .................................&&&&............................
 * ...............................&&&&..............................
 * .............................&&&&&&..............................
 * ...........................&&&&&&....&&&..&&&&&&&&&&&&&&&........
 * ..................&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&..............
 * ................&...&&&&&&&&&&&&&&&&&&&&&&&&&&&&.................
 * .......................&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&.........
 * ...................&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&...............
 * ..................&&&   &&&&&&&&&&&&&&&&&&&&&&&&&&&&&............
 * ...............&&&&&@  &&&&&&&&&&..&&&&&&&&&&&&&&&&&&&...........
 * ..............&&&&&&&&&&&&&&&.&&....&&&&&&&&&&&&&..&&&&&.........
 * ..........&&&&&&&&&&&&&&&&&&...&.....&&&&&&&&&&&&&...&&&&........
 * ........&&&&&&&&&&&&&&&&&&&.........&&&&&&&&&&&&&&&....&&&.......
 * .......&&&&&&&&.....................&&&&&&&&&&&&&&&&.....&&......
 * ........&&&&&.....................&&&&&&&&&&&&&&&&&&.............
 * ..........&...................&&&&&&&&&&&&&&&&&&&&&&&............
 * ................&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&............
 * ..................&&&&&&&&&&&&&&&&&&&&&&&&&&&&..&&&&&............
 * ..............&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&....&&&&&............
 * ...........&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&......&&&&............
 * .........&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&.........&&&&............
 * .......&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&...........&&&&............
 * ......&&&&&&&&&&&&&&&&&&&...&&&&&&...............&&&.............
 * .....&&&&&&&&&&&&&&&&............................&&..............
 * ....&&&&&&&&&&&&&&&.................&&...........................
 * ...&&&&&&&&&&&&&&&.....................&&&&......................
 * ...&&&&&&&&&&.&&&........................&&&&&...................
 * ..&&&&&&&&&&&..&&..........................&&&&&&&...............
 * ..&&&&&&&&&&&&...&............&&&.....&&&&...&&&&&&&.............
 * ..&&&&&&&&&&&&&.................&&&.....&&&&&&&&&&&&&&...........
 * ..&&&&&&&&&&&&&&&&..............&&&&&&&&&&&&&&&&&&&&&&&&.........
 * ..&&.&&&&&&&&&&&&&&&&&.........&&&&&&&&&&&&&&&&&&&&&&&&&&&.......
 * ...&&..&&&&&&&&&&&&.........&&&&&&&&&&&&&&&&...&&&&&&&&&&&&......
 * ....&..&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&...........&&&&&&&&.....
 * .......&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&..............&&&&&&&....
 * .......&&&&&.&&&&&&&&&&&&&&&&&&..&&&&&&&&...&..........&&&&&&....
 * ........&&&.....&&&&&&&&&&&&&.....&&&&&&&&&&...........&..&&&&...
 * .......&&&........&&&.&&&&&&&&&.....&&&&&.................&&&&...
 * .......&&&...............&&&&&&&.......&&&&&&&&............&&&...
 * ........&&...................&&&&&&.........................&&&..
 * .........&.....................&&&&........................&&....
 * ...............................&&&.......................&&......
 * ................................&&......................&&.......
 * .................................&&..............................
 * ..................................&..............................
 * 
 * @Author: DarkFox
 * @Date: 2025-01-21 16:57:21
 * @LastEditTime: 2025-01-21 16:57:22
 * @LastEditors: DarkFox
 * @Description: 
 * @FilePath: \[250120]在线思维导图\README.md
 * Designed by DarkFox
 -->

# ThinkFlow

A real-time collaborative mind mapping application built with Vue.js and Node.js.

## Features

- **Intuitive Interface**: Clean and modern UI design for easy mind mapping
- **Real-time Collaboration**: Work together with team members in real-time
- **Canvas Navigation**:
  - Middle mouse button: Pan/drag the canvas
  - Mouse wheel: Zoom in/out
  - Box selection: Click and drag with left mouse button to select multiple nodes
- **Node Operations**:
  - Double-click: Edit node content
  - Ctrl/Cmd + Click: Multi-select nodes
  - Enter: Add child node
  - Delete/Backspace: Remove selected node(s)
  - Ctrl/Cmd + Z: Undo
  - Ctrl/Cmd + Shift + Z: Redo
- **Advanced Features**:
  - Auto-layout
  - Node styling (colors, shapes)
  - Export to PNG/PDF
  - Import/Export JSON
  - Search nodes
  - Offline support

## Quick Start

1. **Installation**
   ```bash
   # Clone the repository
   git clone https://github.com/DarkFoxTechnology/ThinkFlow.git

   # Install dependencies
   npm install
   ```

2. **Development**
   ```bash
   # Start development server
   npm run dev
   ```

3. **Production**
   ```bash
   # Build for production
   npm run build

   # Start production server
   npm run start
   ```

## Basic Usage

1. **Creating Your First Mind Map**
   - Click the "New" button to start a fresh mind map
   - Double-click the central node to edit its content
   - Press Enter to create child nodes
   - Use Tab to create sibling nodes

2. **Navigation**
   - Hold middle mouse button to pan around the canvas
   - Use mouse wheel to zoom in/out
   - Click and drag with left mouse button on empty canvas to select multiple nodes

3. **Node Management**
   - Select nodes by clicking or using box selection
   - Double-click to edit node content
   - Use keyboard shortcuts for quick operations:
     - Enter: Add child node
     - Tab: Add sibling node
     - Delete: Remove selected node(s)
     - Ctrl/Cmd + Z: Undo
     - Ctrl/Cmd + Shift + Z: Redo

4. **Collaboration**
   - Share your mind map URL with team members
   - Changes sync automatically in real-time
   - See who's currently editing with user indicators

## Advanced Features

1. **Auto Layout**
   - Click the "Auto Layout" button to organize nodes automatically
   - Nodes arrange themselves in a hierarchical structure

2. **Styling**
   - Select nodes to access the style panel
   - Customize:
     - Background color
     - Text color
     - Border style

3. **Export/Import**
   - Export formats:
     - PNG image
     - PDF document
     - JSON data
   - Import from:
     - JSON files
     - Text outlines

4. **Search**
   - Use the search bar to find nodes
   - Results highlight automatically
   - Navigate between results with arrow keys

## Deployment

1. **Prerequisites**
   - Node.js >= 14
   - MongoDB >= 4.0
   - Modern web browser

2. **Environment Setup**
   ```bash
   # Create .env file
   cp .env.example .env

   # Configure environment variables
   MONGODB_URI=your_mongodb_uri
   PORT=3000
   ```

3. **Production Deployment**
   ```bash
   # Install dependencies
   npm install --production

   # Build frontend
   npm run build

   # Start server
   npm run start
   ```

4. **Docker Deployment**
   ```bash
   # Build image
   docker build -t online-mindmap .

   # Run container
   docker run -p 3000:3000 online-mindmap
   ```

## Troubleshooting

1. **Connection Issues**
   - Check your internet connection
   - Verify WebSocket server is running
   - Clear browser cache if needed

2. **Performance Tips**
   - Limit large mind maps to improve performance
   - Use auto-layout for better organization
   - Close unused branches to reduce rendering load

3. **Common Issues**
   - If nodes overlap, try auto-layout
   - If changes don't sync, check your connection
   - If export fails, try reducing mind map size

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please:
1. Check the documentation
2. Search existing issues
3. Create a new issue if needed

---
Made with ❤️ by DarkFox

