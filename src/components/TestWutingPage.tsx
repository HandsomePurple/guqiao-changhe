import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import { OBJLoader } from 'three/addons/loaders/OBJLoader';
import { MTLLoader } from 'three/addons/loaders/MTLLoader';

export default function TestWutingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>(['=== 五亭桥诊断测试 ===']);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-40), msg]);
    console.log(msg);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    const camera = new THREE.PerspectiveCamera(
      45, containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.01, 2000
    );
    camera.position.set(0, 2, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff8ee, 0xc4a87c, 1.0));
    scene.add(new THREE.AmbientLight(0xfff8f0, 1.2));
    const dir = new THREE.DirectionalLight(0xfff5e6, 1.5);
    dir.position.set(8, 10, 5);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const grid = new THREE.GridHelper(10, 20, 0x444444, 0x333333);
    grid.position.y = -1;
    scene.add(grid);

    // ===== 方案1：直接 fetch 原始 OBJ 文件文本，分析结构 =====
    const OBJ_URL = 'models/五亭桥带贴图模型-新2/五亭桥模型.obj';
    const MTL_URL = 'models/五亭桥带贴图模型-新2/Meshy_AI_Pavilion_Bridge_0630074245_texture.mtl';

    addLog('Step1: fetch 原始 OBJ 分析结构...');

    fetch(OBJ_URL).then(r => r.text()).then(objText => {
      const lines = objText.split('\n');
      const totalLines = lines.length;
      let vCount = 0, vtCount = 0, vnCount = 0, fCount = 0, lCount = 0, oCount = 0, gCount = 0, usemtlCount = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('v ')) vCount++;
        else if (trimmed.startsWith('vt ')) vtCount++;
        else if (trimmed.startsWith('vn ')) vnCount++;
        else if (trimmed.startsWith('f ')) fCount++;
        else if (trimmed.startsWith('l ')) lCount++;
        else if (trimmed.startsWith('o ')) oCount++;
        else if (trimmed.startsWith('g ')) gCount++;
        else if (trimmed.startsWith('usemtl ')) usemtlCount++;
      }

      // 找到 f 和 l 的起始位置
      let firstFLine = -1, firstLLine = -1, lastFLine = -1, lastLLine = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('f ') && firstFLine < 0) firstFLine = i + 1;
        if (lines[i].trim().startsWith('l ') && firstLLine < 0) firstLLine = i + 1;
        if (lines[i].trim().startsWith('f ')) lastFLine = i + 1;
        if (lines[i].trim().startsWith('l ')) lastLLine = i + 1;
      }

      addLog('OBJ 结构统计:');
      addLog('  总行数=' + totalLines +
        ' | v=' + vCount + ' vt=' + vtCount + ' vn=' + vnCount +
        ' | f=' + fCount + ' | l=' + lCount);
      addLog('  o=' + oCount + ' g=' + gCount + ' usemtl=' + usemtlCount);
      addLog('  f范围: L' + firstFLine + '~L' + lastFLine +
        ' | l范围: L' + firstLLine + '~L' + lastLLine);
      addLog('  l在f' + (firstLLine > lastFLine ? '之后' : '之前') + ' (l在f之后说明是额外线段)');

      // ===== Step2: 用原始 OBJ 直接加载 =====
      addLog('');
      addLog('Step2: OBJLoader 直接加载原始OBJ...');

      // 先加载MTL
      const mtlLoader = new MTLLoader();
      mtlLoader.setResourcePath('models/五亭桥带贴图模型-新2/');
      mtlLoader.setPath('models/五亭桥带贴图模型-新2/');

      mtlLoader.load('Meshy_AI_Pavilion_Bridge_0630074245_texture.mtl', function(materials) {
        addLog('MTL OK: ' + Object.keys(materials.materials).join(','));
        materials.preload();

        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.setPath('models/五亭桥带贴图模型-新2/');

        objLoader.load('五亭桥模型.obj', function(obj) {
          let meshC = 0, lineC = 0, ptsC = 0;
          const details: string[] = [];

          obj.traverse(function(child) {
            if (child.isMesh) {
              meshC++;
              const g = child.geometry;
              details.push('[MESH] name=' + child.name +
                ' pos=' + (g.attributes.position?.count || 0) +
                ' uv=' + (g.attributes.uv?.count || 0) +
                ' idx=' + (g.index?.count || 0) +
                ' matMap=' + !!(child as THREE.Mesh).material?.map);
            }
            else if (child.isLineSegments) { lineC++; details.push('[LINE] ' + child.name); }
            else if (child.isPoints) { ptsC++; details.push('[POINTS] ' + child.name); }
            else { details.push('[OTHER:' + child.type + '] ' + child.name); }
          });

          addLog('原始OBJ结果: meshes=' + meshC + ' lines=' + lineC + ' points=' + ptsC);
          addLog('子对象: ' + details.join(' | '));

          // 居中+放大10倍
          const box = new THREE.Box3().setFromObject(obj);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          obj.position.sub(box.getCenter(new THREE.Vector3()));
          obj.scale.setScalar(50);  // 放大50倍

          // 根据大小调整相机（确保能看到）
          const fovRad = camera.fov * Math.PI / 180;
          const scaledDim = maxDim * 50;
          const dist = Math.max((scaledDim / 2) / Math.tan(fovRad / 2) * 2.5, 5);
          camera.position.set(0, scaledDim * 0.8, dist);
          controls.target.set(0, 0, 0);
          controls.update();

          scene.add(obj);
          addLog('相机已调整: dist=' + dist.toFixed(2) + ' size=' + (maxDim*50).toFixed(3) + ' scale=50x');

          // ===== Step3: 去掉 l 行后重新加载对比 =====
          addLog('');
          addLog('Step3: 去掉尾部l行后重新加载...');

          const cleanedLines = lines.filter(l => !l.trim().startsWith('l '));
          const cleanedText = cleanedLines.join('\n');
          const removedCount = lCount;

          // 手动解析清理后的OBJ文本
          const objLoader2 = new OBJLoader();
          // 使用 parse 方法直接解析文本
          const obj2 = objLoader2.parse(cleanedText);

          let meshC2 = 0, lineC2 = 0;
          obj2.traverse(function(child) {
            if (child.isMesh) meshC2++;
            else if (child.isLineSegments) lineC2++;
          });

          addLog('去l后结果: meshes=' + meshC2 + ' lines=' + lineC2 + ' (去掉了' + removedCount + '行l)');

          if (meshC2 > 0) {
            // 放在右边对比
            obj2.position.sub(new THREE.Box3().setFromObject(obj2).getCenter(new THREE.Vector3()));
            obj2.position.x += maxDim * 1.8;
            scene.add(obj2);
            addLog('>> 去l后变成Mesh了!!! 放在右侧对比');
          } else {
            addLog('>> 去了l仍然是Line... 说明不是l的问题!');
          }

        }, undefined, function(err) {
          addLog('OBJ FAIL: ' + err);
        });
      }, function(err) {
        addLog('MTL FAIL: ' + err);
      });

    }).catch(function(err) {
      addLog('fetch FAIL: ' + err);
    });

    // 渲染循环
    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement.parentNode) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh', background:'#1a1a2e', overflow:'hidden' }}>
      {/* 日志 */}
      <div style={{
        position:'fixed', top:0, left:0, bottom:0, width:450, zIndex:100,
        background:'rgba(0,0,0,0.88)', color:'#fff', padding:12,
        fontSize:11, lineHeight:1.65, fontFamily:'monospace',
        overflowY:'auto', borderRight:'1px solid #333'
      }}>
        <strong style={{ color:'#8df', fontSize:13 }}>五亭桥深度诊断</strong>
        <hr style={{ borderColor:'#333', margin:'6px 0' }} />
        {logs.map((log, i) => {
          let c = '#aaa';
          if (log.includes('FAIL')) c = '#f44';
          else if (log.includes('OK')) c = '#4f8';
          else if (log.includes('>>>')) c = '#ff4';
          else if (log.includes('Step')) c = '#fa4';
          return <div key={i} style={{ color:c }}>{log}</div>;
        })}
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex:1, marginLeft:450 }} />
    </div>
  );
}
