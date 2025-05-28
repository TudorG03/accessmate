import { useAuthStore } from "../auth.store";

/**
 * Custom hook for profile picture management
 */
const useProfilePicture = () => {
    const user = useAuthStore((s) => s.user);
    const uploadProfilePicture = useAuthStore((s) => s.uploadProfilePicture);
    const deleteProfilePicture = useAuthStore((s) => s.deleteProfilePicture);
    const isLoading = useAuthStore((s) => s.isLoading);
    const error = useAuthStore((s) => s.error);

    const hasProfilePicture = Boolean(user?.profilePicture);

    const uploadPicture = async (profilePicture: string) => {
        if (!user?.id) {
            throw new Error("User not authenticated");
        }
        await uploadProfilePicture(user.id, profilePicture);
    };

    const deletePicture = async () => {
        if (!user?.id) {
            throw new Error("User not authenticated");
        }
        await deleteProfilePicture(user.id);
    };

    return {
        user,
        profilePicture: user?.profilePicture,
        hasProfilePicture,
        uploadPicture,
        deletePicture,
        isLoading,
        error,
    };
};

export default useProfilePicture;
