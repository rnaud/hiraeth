// Pure native-build input policy, shared without importing GitHub history or CLI IO.
export const relevantUnityInput = path => /^(src|public|engine|unity|scripts|data)\//.test(path) || /^(package(?:-lock)?\.json|index\.html|vite\.config\.[^/]+|\.github\/workflows\/unity-android\.yml)$/.test(path);
