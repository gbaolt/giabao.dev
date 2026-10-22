'use client';

import { useRouter } from '@bprogress/next/app';
import {
  AwardIcon,
  BoxIcon,
  BriefcaseBusinessIcon,
  CornerDownLeftIcon,
  DownloadIcon,
  FileUser,
  HomeIcon,
  LayersIcon,
  LayersPlusIcon,
  MailIcon,
  MonitorIcon,
  MoonStarIcon,
  NewspaperIcon,
  PhoneIcon,
  ServerIcon,
  SunMediumIcon,
  TextInitial,
} from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import React from 'react';
import { toast } from 'sonner';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Empty, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { RESUME_PDF_FILENAME } from '@/config/resume';
import { UTM_PARAMS } from '@/config/site';
import { useCommandMenu } from '@/context/command-menu-provider';
import { SOCIAL_LINKS } from '@/features/portfolio/data/social-links';
import { USER } from '@/features/portfolio/data/user';
import { haptic } from '@/lib/haptic';
import type { DocPreview } from '@/types/document';
import { copyText } from '@/utils/copy';
import { decodeEmail, decodePhoneNumber } from '@/utils/string';
import { addQueryParams } from '@/utils/url';

import { Brand } from './brand';

type CommandType = 'command' | 'page' | 'section' | 'link';

type CommandLinkItem = {
  title: string;
  href: string;
  type: CommandType;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconImage?: string;
  keywords?: string[];
  openInNewTab?: boolean;
};

const MENU_LINKS: CommandLinkItem[] = [
  {
    title: 'Home',
    href: '/',
    type: 'page',
    icon: HomeIcon,
  },
  {
    title: 'Blog',
    href: '/blog',
    type: 'page',
    icon: NewspaperIcon,
  },
  {
    title: 'Resume',
    href: '/resume',
    type: 'page',
    icon: FileUser,
  },
  {
    title: 'Create',
    href: '/create',
    type: 'page',
    icon: LayersPlusIcon,
  },
];

const PORTFOLIO_LINKS: CommandLinkItem[] = [
  {
    title: 'About',
    href: '/#about',
    type: 'section',
    icon: TextInitial,
  },
  {
    title: 'Tech Stack',
    href: '/#stack',
    type: 'section',
    icon: LayersIcon,
  },
  {
    title: 'Blog',
    href: '/#blog',
    type: 'section',
    icon: NewspaperIcon,
  },
  {
    title: 'Experience',
    href: '/#experience',
    type: 'section',
    icon: BriefcaseBusinessIcon,
  },
  {
    title: 'Projects',
    href: '/#projects',
    type: 'section',
    icon: BoxIcon,
  },
  {
    title: 'Honors & Awards',
    href: '/#awards',
    type: 'section',
    icon: AwardIcon,
  },
];

const SOCIAL_LINK_ITEMS: CommandLinkItem[] = SOCIAL_LINKS.map((item) => ({
  title: item.title,
  href: addQueryParams(item.href, UTM_PARAMS),
  type: 'link',
  iconImage: item.icon,
  openInNewTab: true,
}));

export function CommandMenuDialog({ blogs }: { blogs: DocPreview[] }) {
  const router = useRouter();
  const { open, setOpen } = useCommandMenu();
  const { setTheme } = useTheme();

  const [selectedCommandType, setSelectedCommandType] =
    React.useState<CommandType | null>(null);

  const handleLinkHover = React.useCallback((link: CommandLinkItem) => {
    setSelectedCommandType(link.type);
  }, []);

  const handleOpenLink = React.useCallback(
    (href: string, openInNewTab = false) => {
      setOpen(false);
      haptic();

      if (openInNewTab) {
        window.open(href, '_blank', 'noopener');
      } else {
        router.push(href);
      }
    },
    [setOpen, router]
  );

  const handleCopy = React.useCallback(
    (text: string, message: string) => {
      setOpen(false);
      haptic();
      copyText(text);
      toast.success(message);
    },
    [setOpen]
  );

  const handleDownload = React.useCallback(
    (link: string, filename: string) => {
      setOpen(false);
      haptic();

      // A temporary anchor with `download` keeps the browser from opening the
      // inline PDF and lets us control the saved filename.
      const anchor = document.createElement('a');
      anchor.href = link;
      anchor.download = filename;
      anchor.click();
    },
    [setOpen]
  );

  const handleSetTheme = React.useCallback(
    (theme: 'light' | 'dark' | 'system') => {
      setOpen(false);
      haptic();
      setTheme(theme);
    },
    [setOpen, setTheme]
  );

  const blogLinks = React.useMemo(
    () =>
      blogs
        .filter((blog) => blog.category === 'blog')
        .map<CommandLinkItem>((blog) => ({
          title: blog.title,
          href: `/blog/${blog.slug}`,
          type: 'page',
          keywords: ['blog'],
        })),
    [blogs]
  );

  return (
    <CommandDialog
      title="Command Menu"
      open={open}
      onOpenChange={setOpen}
      modal="trap-focus"
      className="not-found-hidden"
    >
      <CommandMenuInput />

      <div className="bg-background ring-border mx-1 rounded-md ring-1">
        <CommandList className="bg-background dark:bg-background/50 scroll-fade min-h-80 rounded-lg">
          <CommandEmpty>
            <Empty className="gap-2">
              <EmptyMedia variant="icon">
                <ServerIcon />
              </EmptyMedia>
              <EmptyTitle>No results found</EmptyTitle>
            </Empty>
          </CommandEmpty>

          <CommandLinkGroup
            heading="Menu"
            links={MENU_LINKS}
            onLinkHover={handleLinkHover}
            onLinkSelect={handleOpenLink}
          />
          <CommandLinkGroup
            heading="Portfolio"
            links={PORTFOLIO_LINKS}
            onLinkHover={handleLinkHover}
            onLinkSelect={handleOpenLink}
          />
          <CommandLinkGroup
            heading="Blog"
            links={blogLinks}
            fallbackIcon={NewspaperIcon}
            onLinkHover={handleLinkHover}
            onLinkSelect={handleOpenLink}
          />
          <CommandLinkGroup
            heading="Social Links"
            links={SOCIAL_LINK_ITEMS}
            onLinkHover={handleLinkHover}
            onLinkSelect={handleOpenLink}
          />

          <CommandGroup heading="Personal Info">
            <CommandItem
              onMouseEnter={() => setSelectedCommandType('command')}
              onSelect={() =>
                handleDownload(USER.resumeDownloadUrl!, RESUME_PDF_FILENAME)
              }
            >
              <DownloadIcon className="text-muted-foreground" />
              Download Resume
            </CommandItem>
            <CommandItem
              onMouseEnter={() => setSelectedCommandType('command')}
              onSelect={() => {
                handleCopy(
                  decodeEmail(USER.email),
                  'Email address copied to clipboard'
                );
              }}
            >
              <MailIcon className="text-muted-foreground" />
              Copy Email Address
            </CommandItem>
            <CommandItem
              onMouseEnter={() => setSelectedCommandType('command')}
              onSelect={() => {
                handleCopy(
                  decodePhoneNumber(USER.phoneNumber),
                  'Phone number copied to clipboard'
                );
              }}
            >
              <PhoneIcon className="text-muted-foreground" />
              Copy Phone Number
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Theme">
            <CommandItem
              keywords={['theme']}
              onMouseEnter={() => setSelectedCommandType('command')}
              onSelect={() => handleSetTheme('light')}
            >
              <SunMediumIcon className="text-muted-foreground" />
              Light
            </CommandItem>
            <CommandItem
              keywords={['theme']}
              onMouseEnter={() => setSelectedCommandType('command')}
              onSelect={() => handleSetTheme('dark')}
            >
              <MoonStarIcon className="text-muted-foreground" />
              Dark
            </CommandItem>
            <CommandItem
              keywords={['theme']}
              onMouseEnter={() => setSelectedCommandType('command')}
              onSelect={() => handleSetTheme('system')}
            >
              <MonitorIcon className="text-muted-foreground" />
              System
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </div>

      <CommandMenuFooter selectedCommandType={selectedCommandType} />
    </CommandDialog>
  );
}

function CommandMenuInput() {
  const [searchValue, setSearchValue] = React.useState('');

  return (
    <CommandInput
      placeholder="Type a command or search…"
      value={searchValue}
      onValueChange={setSearchValue}
    />
  );
}

function CommandLinkGroup({
  heading,
  links,
  fallbackIcon,
  onLinkHover,
  onLinkSelect,
}: {
  heading: string;
  links: CommandLinkItem[];
  fallbackIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onLinkHover: (link: CommandLinkItem) => void;
  onLinkSelect: (href: string, openInNewTab?: boolean) => void;
}) {
  return (
    <CommandGroup heading={heading}>
      {links.map((link) => {
        const Icon = link?.icon ?? fallbackIcon ?? React.Fragment;

        return (
          <CommandItem
            key={link.href}
            value={`${link.type}-${link.title}-${link.href}`}
            keywords={link.keywords}
            onMouseEnter={() => onLinkHover(link)}
            onSelect={() => onLinkSelect(link.href, link.openInNewTab)}
          >
            {link?.iconImage ? (
              <Image
                className="corner-squircle rounded-sm supports-corner-shape:rounded-[50%]"
                src={link.iconImage}
                alt={link.title}
                width={16}
                height={16}
                unoptimized
              />
            ) : (
              <Icon className="text-muted-foreground" />
            )}
            <p className="line-clamp-1">{link.title}</p>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

const ENTER_ACTION_LABELS: Record<CommandType, string> = {
  command: 'Run Command',
  page: 'Go to Page',
  section: 'Go to Section',
  link: 'Open Link',
};

function CommandMenuFooter({
  selectedCommandType,
}: {
  selectedCommandType: CommandType | null;
}) {
  return (
    <>
      <div className="flex h-10" />

      <div className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-between gap-2 rounded-b-2xl px-4 text-xs font-medium">
        <Brand className="text-muted-foreground size-6" />

        <div className="flex shrink-0 items-center gap-2 max-sm:hidden">
          <span>{ENTER_ACTION_LABELS[selectedCommandType ?? 'page']}</span>
          <Kbd>
            <CornerDownLeftIcon />
          </Kbd>
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-center"
          />
          <span className="text-muted-foreground">Exit</span>
          <Kbd>Esc</Kbd>
        </div>
      </div>
    </>
  );
}
