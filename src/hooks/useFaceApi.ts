import * as faceApi from "face-api.js";
import * as React from "react";
import { FaceResult } from "../types";
import useResource from "./useResource";

const MODELS_URI = "/face-api/weights";

const ensureModels = async (nets: faceApi.NeuralNetwork<unknown>[]) =>
  Promise.all(
    nets.map((net) =>
      net.isLoaded ? Promise.resolve() : net.loadFromUri(MODELS_URI)
    )
  );

export interface FaceApiParams {
  tiny: boolean;
  allFaces: boolean;
  withExpressions: boolean;
  withAgeAndGender: boolean;
  withDescriptors: boolean;
  withLandmarks: boolean;
  scoreThreshold: number;
}

export default function useFaceApi({
  tiny,
  allFaces,
  withExpressions,
  withAgeAndGender,
  withDescriptors,
  withLandmarks,
  scoreThreshold,
}: FaceApiParams) {
  const getNeuralNetwork = React.useCallback(async () => {
    const { nets } = faceApi;
    const models: faceApi.NeuralNetwork<unknown>[] = [
      tiny ? nets.tinyFaceDetector : nets.ssdMobilenetv1,
    ];
    if (withExpressions) models.push(nets.faceExpressionNet);
    if (withAgeAndGender) models.push(nets.ageGenderNet);
    if (withLandmarks)
      models.push(tiny ? nets.faceLandmark68Net : nets.faceLandmark68TinyNet);
    if (withDescriptors) models.push(nets.faceRecognitionNet);
    await ensureModels(models);
    const opts = tiny
      ? new faceApi.TinyFaceDetectorOptions({ scoreThreshold })
      : new faceApi.SsdMobilenetv1Options({ minConfidence: scoreThreshold });
    async function applyModel(input: faceApi.TNetInput) {
      /**
       * Even in case if we use detectSingleFace, we wrap the result in an array
       * to keep the format consistent for all cases.
       * face-api.js return value is structured differently based on whether
       * we require additional processing, so it's difficult to make TS infer
       * the type for us in all cases.
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let task: any = (allFaces
        ? faceApi.detectAllFaces
        : faceApi.detectSingleFace)(input, opts);
      if (withLandmarks) task = task.withFaceLandmarks();
      if (withDescriptors) task = task.withFaceDescriptors();
      if (withExpressions) task = task.withFaceExpressions();
      if (withAgeAndGender) task = task.withAgeAndGender();
      let result = await task;
      result = !result ? [] : Array.isArray(result) ? result : [result];
      if (!withExpressions && !withAgeAndGender)
        result = result.map((rec: faceApi.FaceDetection) => ({
          detection: rec,
        }));
      return result as FaceResult[];
    }
    return { apply: applyModel };
  }, [
    tiny,
    allFaces,
    withExpressions,
    withAgeAndGender,
    withDescriptors,
    withLandmarks,
    scoreThreshold,
  ]);
  return useResource(getNeuralNetwork);
}
