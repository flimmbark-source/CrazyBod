from pathlib import Path

path = Path('src/world/JourneyScene.jsx')
source = path.read_text()


def replace_once(old, new, label):
    global source
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    source = source.replace(old, new, 1)


replace_once(
    """    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
""",
    """    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  }, -1)

  return null
}
""",
    'run authored camera before narrative camera',
)

replace_once(
    """        <Chair position={[0, 0, -1.6]} color=\"#684c45\" />
        <Cylinder position={[-0.35, 1.18, -0.08]} args={[0.14, 0.12, 0.28, 9]} color=\"#eee1d2\" />
""",
    """        <Chair position={[0, 0, -1.6]} rotation={[0, Math.PI, 0]} color=\"#684c45\" />
        <Chair position={[0, 0, 1.6]} color=\"#684c45\" />
        <Cylinder position={[-0.35, 1.18, -0.08]} args={[0.14, 0.12, 0.28, 9]} color=\"#eee1d2\" />
""",
    'orient Mara chair and add player chair',
)

path.write_text(source)
