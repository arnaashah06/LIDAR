# Spatial Sentinel — Adaptive 2.5D LiDAR Perception

> **Budget-Aware Adaptive Resolution 2.5D LiDAR Mapping with Dynamic Object Separation**  
> *DRDO Smart Vehicles | Smart India Hackathon 2026 (SIH26053)*

## 🔒 Private Access Notice
This deployment contains proprietary algorithms and is configured for link-only access. Search engine crawlers are blocked via `robots.txt` and `<meta name="robots" content="noindex, nofollow">`.

### Direct Authorized Access
To open the live site with automatic authentication:
```
https://arnaashah06.github.io/spatial-sentinel/?key=sentinel2026
```
(Or enter the access code `sentinel2026` at the prompt).

---

## Key Features
- **Hardware Compute-Budget Controller**: Dynamic memory & latency governor with presets for 5W Micro-UGVs, Embedded Jetson Orin Nano, and Workstations.
- **5 Output Layers**: Elevation heatmap, Kalman variance ($\sigma^2$), Traversability costmap, Dynamic separation mask, and Quadtree resolution levels.
- **Ghost Trail Removal**: Free-space ray consistency checking separates moving obstacles from static terrain.
- **Interactive 3D LiDAR Mode**: Real-time perspective voxel heightfield visualization.
