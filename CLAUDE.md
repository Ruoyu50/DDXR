# 风感装置 3D 原型

## 项目目标

"风感装置"的 3D 原型。研究问题：**什么触发了"我在掌控风"的主观感受（控风感）**。

核心体验：用户挥手（目前用鼠标/触摸模拟），风随之改变方向和强弱，场景里的物体可见地被风吹动。

设计原则：**手改变风向，而不是凭空造风**。场景里始终有一股柔和的底风，手势只是把已有的风转向并加强；停手后风强平滑衰减回底风，风向平滑过渡，不突变。

## 技术栈与命令

Next.js 15.5（App Router + Turbopack）、React 19、TypeScript、three r180、@react-three/fiber 9、drei 10、@react-three/xr 6。

- `npm run dev`：本地开发（http://localhost:3000）
- `npm run build`：构建，同时做类型检查和 lint，改完代码必须跑通
- `npm run lint`：单独跑 ESLint

部署在 Vercel，仓库是 https://github.com/Ruoyu50/DDXR 。Vercel 会拦截有安全漏洞的 Next.js 版本，升级时只升 15.5.x 补丁，不跨大版本。

## 架构

所有代码在 `app/` 下，入口是 `app/page.tsx`（`<Canvas>`、灯光、相机、地面、XR 都在这里）。

数据流是单向的：**输入 → 风状态 → 被风吹的物体**。

```
input/pointerInput.ts ──┐
(以后: 摄像头手部追踪)  ─┴─> WindDriver.tsx ──> wind.ts ──> windBend.ts ──> PottedPlant / Grass
                                                   └──────> WindHud.tsx
```

- **`components/input/`**：输入模块。`gesture.ts` 定义契约：`Gesture`（屏幕空间的挥动方向单位向量 + 速度，单位是"视口高度/秒"）和 `GestureSource` 接口（每帧 `sample()` 一次）。`pointerInput.ts` 是鼠标/触摸实现。输入模块只产出挥动方向和速度，不知道风和 3D 场景。
- **`components/WindDriver.tsx`**：唯一连接输入和风的地方。每帧取一次手势，按相机视角换算成水平世界方向，调用 `steerWind()` 和 `updateWind()`。接新输入只改这里。
- **`components/wind.ts`**：风状态（模块级单例）。对外只读的 `wind.direction`（水平单位向量 x/z）和 `wind.strength`（0–1）。只认世界方向，不依赖鼠标、相机或 React。
- **`components/windBend.ts`**：可复用的弯曲模块。`applyWindBend(material, options)` 用 `onBeforeCompile` 在顶点着色器里做"按高度弯曲"：局部坐标 `minY` 以下完全不动，往上按高度平滑增加位移。`createWindDepthMaterial()` 让影子跟着弯。`syncWindUniforms()` 每帧把风状态写进共享 uniform（多处调用是安全的）。
- **`components/PottedPlant.tsx`**：盆栽（`public/potted-plant.glb`，单一网格）。阈值设在花盆口，花盆不动，茎叶弯曲。原模型面数太少，用 `TessellateModifier` 细分过。
- **`components/Grass.tsx`**：程序化草地，一个 `InstancedMesh`，风的主要可见载体。矩阵只在创建时设置一次，动画全在 GPU 上。
- **`components/WindHud.tsx`**：左上角的调试覆盖层，显示风向和风强。

### 必须保持的约束

- 风状态和被风吹的物体**不能直接依赖鼠标事件**。新输入实现 `GestureSource`，在 `WindDriver` 里接入。
- 新的受风物体共享 `wind.ts` + `windBend.ts`，不要另外实现一套风。
- 动画放在着色器里，不要在 `useFrame` 里逐实例更新矩阵。
- `Cube.tsx` 和根目录的 `Potted-plant.jsx` 是早期教程遗留，目前没有被引用。

## 手感参数的位置

| 想调什么 | 文件 | 参数 |
|---|---|---|
| 底风强度 | `wind.ts` | `BASE_STRENGTH` |
| 挥多快算满风 / 多慢算噪声 | `wind.ts` | `FULL_GUST_SPEED`、`MIN_GESTURE_SPEED` |
| 手势转向的力度 | `wind.ts` | `STEER_RATE` |
| 停手后阵风持续多久、强度和方向的平滑 | `wind.ts` | `GUST_DECAY`、`STRENGTH_SMOOTHING`、`DIRECTION_SMOOTHING` |
| 阵风波带的宽窄和移动速度 | `windBend.ts` | `GUST_WAVE_SCALE`、`GUST_WAVE_SPEED` |
| 风强对整体运动速度的影响 | `windBend.ts` | `WIND_TIME_BASE_RATE`、`WIND_TIME_STRENGTH_RATE` |
| 植物弯曲阈值（花盆口高度） | `PottedPlant.tsx` | `POT_RIM_Y`、`PLANT_TOP_Y`（模型原始坐标，注释里有数值来源） |
| 植物弯曲幅度、曲线、抖动、阵风起伏 | `PottedPlant.tsx` | `WIND_BEND` 里的 `bend`、`power`、`flutter`、`flutterFrequency`、`flutterScale`、`gustDepth` |
| 植物细分程度 | `PottedPlant.tsx` | `MAX_EDGE_LENGTH`、`TESSELLATE_ITERATIONS` |
| 草的弯曲幅度、曲线、抖动、阵风起伏 | `Grass.tsx` | `createGrass()` 里传给 `applyWindBend` 的同名选项 |
| 草的密度和范围 | `Grass.tsx` | `BLADE_COUNT`、`FIELD_RADIUS`、`CLEAR_RADIUS` |
| 草的大小和分段 | `Grass.tsx` | `BLADE_MIN_HEIGHT`、`BLADE_MAX_HEIGHT`、`BLADE_WIDTH`、`BLADE_SEGMENTS` |
| 相机、灯光、雾、背景色、XR 站位 | `page.tsx` | `<Canvas camera>`、灯光、`<fog>`、`SKY_COLOR`、`<XROrigin>` |

各选项的含义见 `windBend.ts` 里 `WindBendOptions` 的注释。`bend` 和 `flutter` 是相对弯曲段高度的比例，所以换模型或改缩放后手感不变。

## 已知问题

- **控制台警告 "Multiple instances of Three.js being imported"**：打包产物里除了 r180 还有一份 r165，来自 XR 模拟器依赖（`node_modules/@iwer/*` 自带嵌套的 three）。不影响渲染。
- **XR 模拟器在本地会报 `material.onBuild` 错误**：`@react-three/xr` 在 localhost 上会自动注入 Meta Quest 模拟器（页面顶部的 "Enter XR" 按钮）。原因尚未确认，推测和上面那份旧版 three 有关。需要时可以在 `createXRStore({ emulate: false })` 里关掉模拟器。
- **弯曲时法线没有更新**：大幅弯曲时光照略不准。
- **草不投射阴影**（为了性能），只接收植物的影子。
- **来回挥手时风向会跟着来回转**：这是"挥动方向引导风向"的直接结果，是否符合控风感需要在实验里观察。
- **构建时的 lockfile 警告**：主目录 `/Users/shiruoyu/` 下也有一个 `package-lock.json`，Next.js 会把工作区根目录推断错。不影响构建。

## 分阶段计划

- **第一阶段（已完成）**：风状态、鼠标输入、受风弯曲的盆栽和草地。
- **第二阶段：花瓣风场**。花瓣随风飘动，让风的方向和强弱更直观。
- **第三阶段：风声 + 摄像头手部捕捉**。用 MediaPipe 做手部追踪，作为新的 `GestureSource` 替换或补充鼠标输入；加入随风强变化的风声。
- **第四阶段：VR**。在头显里体验，用手柄或手部追踪作为输入。

每个阶段只做该阶段范围内的事，不要提前实现后面的阶段。
