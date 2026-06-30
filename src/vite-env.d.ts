/// <reference types="vite/client" />
/// <reference types="dom-webcodecs" />

interface Navigator {
  gpu?: GPU
}

interface WorkerNavigator {
  gpu?: GPU
}

type GPU = unknown
