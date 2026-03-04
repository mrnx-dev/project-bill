export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col space-y-6 max-w-5xl mx-auto w-full">
            <div className="w-full pt-2">
                {children}
            </div>
        </div>
    );
}
