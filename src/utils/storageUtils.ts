import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid'; // For generating unique filenames
import { storage } from '../firebase'; // Assuming storage is exported from firebase.ts

/**
 * Uploads an image file to Firebase Storage under the 'chat_images/' path.
 * Generates a unique filename using UUID.
 *
 * @param file The image file to upload.
 * @returns A promise that resolves with the public download URL of the uploaded image.
 * @throws Throws an error if the upload fails.
 */
export const uploadImageToFirebaseStorage = async (file: File): Promise<string> => {
    if (!file) {
        throw new Error("No file provided for upload.");
    }

    // Generate a unique filename to prevent overwrites
    const fileExtension = file.name.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const imageRef = ref(storage, `chat_images/${uniqueFilename}`);

    try {
        console.log(`Uploading image to: ${imageRef.fullPath}`);
        const snapshot = await uploadBytes(imageRef, file);
        console.log('Upload successful:', snapshot);

        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('Download URL:', downloadURL);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading image to Firebase Storage:", error);
        // Re-throw the error to be handled by the caller
        throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
